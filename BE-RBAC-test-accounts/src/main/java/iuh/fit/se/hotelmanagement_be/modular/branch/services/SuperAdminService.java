package iuh.fit.se.hotelmanagement_be.modular.branch.services;

import iuh.fit.se.hotelmanagement_be.modular.branch.requests.SuperAdminCreateBranchRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.requests.BranchRoomPolicyRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchDetailResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchSummaryResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminProvinceResponse;

import java.util.List;

public interface SuperAdminService {
    List<SuperAdminProvinceResponse> getProvinces();

    List<SuperAdminBranchSummaryResponse> getBranches();

    List<SuperAdminBranchSummaryResponse> getBranchesByProvince(String provinceId);

    SuperAdminBranchSummaryResponse createBranch(SuperAdminCreateBranchRequest request);

    SuperAdminBranchDetailResponse getBranchDetails(Long hotelId);

    List<SuperAdminBranchDetailResponse.RoomPolicyItem> saveBranchRoomPolicies(
            Long hotelId,
            List<BranchRoomPolicyRequest> requests);
}
